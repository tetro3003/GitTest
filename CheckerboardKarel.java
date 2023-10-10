import stanford.karel.Karel;

public class CheckerboardKarel extends Karel{
	
	public void run(){
		
		 checkers();
		
	}
	
	private void checkers(){
		
		if(frontIsClear()){
			while(frontIsClear()){
				
				putBeeper();
				move();
				if(frontIsClear()) move();
				else {
					
					turnLeft();
					move();
					if(noBeepersPresent()){
						turnLeft();
						while(frontIsClear()){
							
							putBeeper();
							move();
							if(frontIsClear()) move();
							
						}
					} else {
						turnLeft();
						turnLeft();
						move();
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
