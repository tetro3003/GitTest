import stanford.karel.Karel;

public class StoneMasonKarel extends Karel {
	
	public void run(){
		
		rebuilder();
		
	}
	
	private void rebuilder(){
		
		while(frontIsClear()){
			
			turnLeft();
			while(frontIsClear()){
				if(noBeepersPresent()) {
					putBeeper();
					}
				turnLeft();
				turnLeft();
				turnLeft();
				while(frontIsClear()){
					move();
				}
				turnLeft();
			}
			
		}
		
	}

}
