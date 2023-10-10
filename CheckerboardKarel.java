import stanford.karel.Karel;

public class CheckerboardKarel extends Karel{
	
	public void run(){
		
		 checkers();
		
	}
	
	private void checkers(){
		
		while(noBeepersPresent()){
			
			putBeeper();
			move();
			move();
			if(frontIsClear());
			else {
				turnLeft();
				move();
				turnLeft();
				while(frontIsClear()){
					putBeeper();
					move();
					move();
					if(frontIsClear());
					else{
						turnLeft();
						turnLeft();
						turnLeft();
						move();
						turnLeft();
						turnLeft();
						turnLeft();
						
					}
				}
			}
			
		}
		
		
	}

}
