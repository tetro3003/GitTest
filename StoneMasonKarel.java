import stanford.karel.Karel;

public class StoneMasonKarel extends Karel {
	
	public void run(){
		
		turnLeft();
		rebuilder();
		
	}
	
	private void rebuilder(){
		
		while(frontIsClear()){
			
		
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
